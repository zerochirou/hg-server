import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/auth-client';
import type {
  BoundingBox,
  PotholeCluster,
  PotholeSeverity,
  PotholeStatus,
} from '@/types/pothole';

interface ClusterFilter {
  bbox?: BoundingBox | null;
  status?: PotholeStatus;
  severity?: PotholeSeverity;
}

export function usePotholeClusters({ bbox, status, severity }: ClusterFilter) {
  const baseUrl = getApiBaseUrl();

  return useQuery({
    queryKey: ['pothole-clusters', bbox, status, severity],
    queryFn: async (): Promise<PotholeCluster[]> => {
      const params = new URLSearchParams();

      if (bbox) {
        params.append('minLat', bbox.minLat.toString());
        params.append('minLon', bbox.minLon.toString());
        params.append('maxLat', bbox.maxLat.toString());
        params.append('maxLon', bbox.maxLon.toString());
      }
      if (status) params.append('status', status);
      if (severity) params.append('severity', severity);

      const res = await fetch(`${baseUrl}/api/pothole-clusters?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Gagal memuat data klaster kerusakan jalan');
      }

      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useUpdateClusterStatus() {
  const queryClient = useQueryClient();
  const baseUrl = getApiBaseUrl();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      severity,
    }: {
      id: string;
      status: PotholeStatus;
      severity?: PotholeSeverity;
    }): Promise<PotholeCluster> => {
      const res = await fetch(`${baseUrl}/api/pothole-clusters/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status,
          ...(severity ? { severity } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Gagal memperbarui status klaster');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
      queryClient.invalidateQueries({ queryKey: ['raw-detections'] });
    },
  });
}

export function useUpdateCluster() {
  const queryClient = useQueryClient();
  const baseUrl = getApiBaseUrl();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PotholeCluster>;
    }): Promise<PotholeCluster> => {
      const res = await fetch(`${baseUrl}/api/pothole-clusters/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Gagal memperbarui data klaster');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  const baseUrl = getApiBaseUrl();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; id: string }> => {
      const res = await fetch(`${baseUrl}/api/pothole-clusters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Gagal menghapus klaster');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}
