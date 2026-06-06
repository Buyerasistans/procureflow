import axios from "axios";

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export interface CampaignPublic {
  id: number;
  code: string;
  name: string;
  description: string | null;
  audience_type: string;
  starts_at: string | null;
  ends_at: string | null;
}

export async function getPublicCampaigns(): Promise<CampaignPublic[]> {
  const { data } = await publicApi.get<CampaignPublic[]>("/api/v1/public/campaigns");
  return data;
}
