import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@lukas-vine.com' },
    update: {},
    create: {
      email: 'demo@lukas-vine.com',
      name: 'Demo User',
    },
  });
  console.log('✅ Created demo user:', user.email);

  // Create a demo project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project-001' },
    update: {},
    create: {
      id: 'demo-project-001',
      name: 'Greenhouse Tasks',
      description: 'Tasks for greenhouse management',
      color: '#10b981',
      userId: user.id,
    },
  });
  console.log('✅ Created demo project:', project.name);

  // Create a section
  const section = await prisma.section.upsert({
    where: { id: 'demo-section-001' },
    update: {},
    create: {
      id: 'demo-section-001',
      name: 'This Week',
      projectId: project.id,
      order: 0,
    },
  });
  console.log('✅ Created demo section:', section.name);

  // Create some labels
  const urgentLabel = await prisma.label.upsert({
    where: { name: 'urgent' },
    update: {},
    create: {
      name: 'urgent',
      color: '#ef4444',
    },
  });

  const maintenanceLabel = await prisma.label.upsert({
    where: { name: 'maintenance' },
    update: {},
    create: {
      name: 'maintenance',
      color: '#3b82f6',
    },
  });
  console.log('✅ Created labels: urgent, maintenance');

  // Create demo tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'Check irrigation system',
      description: 'Verify all zones are working properly',
      priority: 3,
      dueDate: new Date(Date.now() + 86400000), // Tomorrow
      userId: user.id,
      projectId: project.id,
      sectionId: section.id,
      order: 0,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Inspect tomato plants for pests',
      description: 'Look for aphids and whiteflies',
      priority: 2,
      dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      userId: user.id,
      projectId: project.id,
      sectionId: section.id,
      order: 1,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Order fertilizer supplies',
      description: 'Stock running low on NPK 10-10-10',
      priority: 1,
      userId: user.id,
      projectId: project.id,
      order: 2,
    },
  });

  console.log('✅ Created demo tasks:', task1.title, task2.title, task3.title);

  // Link labels to tasks
  await prisma.taskLabel.create({
    data: {
      taskId: task1.id,
      labelId: urgentLabel.id,
    },
  });

  await prisma.taskLabel.create({
    data: {
      taskId: task2.id,
      labelId: maintenanceLabel.id,
    },
  });
  console.log('✅ Linked labels to tasks');

  // Create a demo plant
  const plant = await prisma.plant.create({
    data: {
      commonName: 'Tomato',
      scientificName: 'Solanum lycopersicum',
      family: 'Solanaceae',
      description: 'Popular garden vegetable plant',
      growingZones: '3-11',
      lightRequirement: 'Full sun',
      waterRequirement: 'Regular watering, keep soil moist',
      soilType: 'Well-draining, rich in organic matter',
    },
  });
  console.log('✅ Created demo plant:', plant.commonName);

  // Create a demo chemical
  const chemical = await prisma.chemical.create({
    data: {
      name: 'Neem Oil',
      type: 'insecticide',
      activeIngredient: 'Azadirachtin',
      description: 'Organic pest control solution',
      applicationRate: '2 tablespoons per gallon of water',
      safetyNotes: 'Safe for organic gardening, apply in early morning or evening',
    },
  });
  console.log('✅ Created demo chemical:', chemical.name);

  // Create a diagnostic record
  const diagnostic = await prisma.diagnosticRecord.create({
    data: {
      plantId: plant.id,
      symptoms: 'yellowing leaves, sticky residue, small insects',
      diagnosis: 'Aphid infestation',
      recommendedAction: 'Spray with neem oil solution, introduce beneficial insects',
      chemicalId: chemical.id,
      severity: 'medium',
      notes: 'Monitor for 7 days and reapply if needed',
    },
  });
  console.log('✅ Created demo diagnostic record');

  // Create a demo request
  const request = await prisma.request.create({
    data: {
      title: 'Rose bush has black spots',
      description: 'Large rose bush in garden bed 3 developing black spots on leaves',
      status: 'pending',
      priority: 2,
      userId: user.id,
      plantName: 'Rose',
      symptoms: 'black spots on leaves, yellowing',
    },
  });
  console.log('✅ Created demo request:', request.title);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
