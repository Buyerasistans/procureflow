export interface SystemEmail {
  id: number;
  email: string;
  password: string;
  description: string;
}

export interface SystemEmailCreate {
  email: string;
  password: string;
  description: string;
}

export interface SystemEmailUpdate {
  password?: string;
  description?: string;
}
