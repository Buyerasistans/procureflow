import { useEffect, useState } from "react";
import { getPublicCampaigns, type CampaignPublic } from "../services/public.service";

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignPublic[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns(null))
      .finally(() => setLoading(false));
  }, []);

  return { campaigns, loading };
}
