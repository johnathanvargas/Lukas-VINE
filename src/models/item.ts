export interface Item {
  id: string;
  name: string;
  description?: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null; // newly tracked field
}

export interface CreateItemDTO {
}
}
