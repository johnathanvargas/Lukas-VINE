/**
 * Integration test for items table updated_at trigger
 * 
 * This test validates that:
 * 1. The public.items table has both created_at and updated_at columns
 * 2. The updated_at column is automatically set on INSERT
 * 3. The updated_at column is automatically updated on UPDATE
 * 4. The trigger function exists and is properly configured
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Items Table Timestamps', () => {
  let testItemId: string;

  beforeAll(async () => {
    // Verify that items table exists and has required columns
    const { error } = await supabase
      .rpc('get_table_columns', { table_name: 'items' })
      .select('column_name');

    if (error) {
      // Fallback: query information_schema directly
      const { data: schemaData } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'items');
      
      expect(schemaData).toBeDefined();
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testItemId) {
      await supabase
        .from('items')
        .delete()
        .eq('id', testItemId);
    }
  });

  test('should introspect items table and verify updated_at column exists', async () => {
    // Query the information schema to verify columns exist
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'items'
          AND column_name IN ('created_at', 'updated_at')
        ORDER BY column_name;
      `
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    // Verify both timestamp columns exist
    const columnNames = data?.map((col: any) => col.column_name) || [];
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  test('should verify trigger function exists', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'items'
          AND trigger_name = 'items_set_updated_at';
      `
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.length).toBeGreaterThan(0);
    
    if (data && data.length > 0) {
      expect(data[0].trigger_name).toBe('items_set_updated_at');
      expect(data[0].event_manipulation).toBe('UPDATE');
    }
  });

  test('should automatically set updated_at on INSERT', async () => {
    // Insert a new item
    const { data: insertedItem, error: insertError } = await supabase
      .from('items')
      .insert({
        name: 'Test Item for Timestamps',
        description: 'Testing automatic timestamp population'
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(insertedItem).toBeDefined();
    expect(insertedItem.created_at).toBeDefined();
    expect(insertedItem.updated_at).toBeDefined();
    
    // Store test item ID for cleanup
    testItemId = insertedItem.id;
    
    // Verify timestamps are set and are recent (within last 10 seconds)
    const createdAt = new Date(insertedItem.created_at);
    const updatedAt = new Date(insertedItem.updated_at);
    const now = new Date();
    
    expect(now.getTime() - createdAt.getTime()).toBeLessThan(10000);
    expect(now.getTime() - updatedAt.getTime()).toBeLessThan(10000);
  });

  test('should automatically update updated_at on UPDATE', async () => {
    // First, get the current updated_at value
    const { data: beforeUpdate, error: beforeError } = await supabase
      .from('items')
      .select('updated_at')
      .eq('id', testItemId)
      .single();

    expect(beforeError).toBeNull();
    expect(beforeUpdate).toBeDefined();
    
    const originalUpdatedAt = new Date(beforeUpdate.updated_at);
    
    // Wait a moment to ensure timestamp will be different
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the item
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({ description: 'Updated description for timestamp test' })
      .eq('id', testItemId)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedItem).toBeDefined();
    
    const newUpdatedAt = new Date(updatedItem.updated_at);
    
    // Verify updated_at was automatically changed and is more recent
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    
    // Verify the difference is reasonable (between 0.5 and 5 seconds)
    const diffMs = newUpdatedAt.getTime() - originalUpdatedAt.getTime();
    expect(diffMs).toBeGreaterThan(500);
    expect(diffMs).toBeLessThan(5000);
  });

  test('should maintain created_at while updating updated_at', async () => {
    const { data: item, error } = await supabase
      .from('items')
      .select('created_at, updated_at')
      .eq('id', testItemId)
      .single();

    expect(error).toBeNull();
    expect(item).toBeDefined();
    
    const originalCreatedAt = new Date(item.created_at);
    const beforeUpdateAt = new Date(item.updated_at);
    
    // Wait and update again
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({ name: 'Updated name' })
      .eq('id', testItemId)
      .select('created_at, updated_at')
      .single();

    expect(updateError).toBeNull();
    expect(updatedItem).toBeDefined();
    
    const finalCreatedAt = new Date(updatedItem.created_at);
    const finalUpdatedAt = new Date(updatedItem.updated_at);
    
    // created_at should not change
    expect(finalCreatedAt.getTime()).toBe(originalCreatedAt.getTime());
    
    // updated_at should be more recent than before
    expect(finalUpdatedAt.getTime()).toBeGreaterThan(beforeUpdateAt.getTime());
  });
});
