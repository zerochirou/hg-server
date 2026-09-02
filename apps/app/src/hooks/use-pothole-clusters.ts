import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoundingBox, PotholeCluster, PotholeSeverity, PotholeStatus } from '@/types/pothole';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ClusterFilter {
  bbox?: BoundingBox | null;
  status?: PotholeStatus;
  severity?: PotholeSeverity;
}

export function usePotholeClusters({ bbox, status, severity }: ClusterFilter) {
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

      const res = await fetch(`${API_BASE_URL}/api/pothole-clusters?${params.toString()}`, {
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

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: PotholeStatus;
    }): Promise<PotholeCluster> => {
      const res = await fetch(`${API_BASE_URL}/api/pothole-clusters/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Gagal memperbarui status klaster');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}

export function useUpdateCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PotholeCluster>;
    }): Promise<PotholeCluster> => {
      const res = await fetch(`${API_BASE_URL}/api/pothole-clusters/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Gagal memperbarui data klaster');
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

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; id: string }> => {
      const res = await fetch(`${API_BASE_URL}/api/pothole-clusters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Gagal menghapus klaster');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}
