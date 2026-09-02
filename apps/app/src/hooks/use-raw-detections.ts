import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RawDetection } from '@/types/pothole';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RawDetectionsFilter {
  limit?: number;
  search?: string;
  deviceId?: string;
}

export function useRawDetections(filter?: RawDetectionsFilter) {
  return useQuery({
    queryKey: ['raw-detections', filter],
    queryFn: async (): Promise<RawDetection[]> => {
      const params = new URLSearchParams();
      if (filter?.limit) params.append('limit', filter.limit.toString());
      if (filter?.search) params.append('search', filter.search);
      if (filter?.deviceId) params.append('deviceId', filter.deviceId);

      const res = await fetch(`${API_BASE_URL}/api/detections?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Gagal memuat data deteksi mentah');
      }

      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useUpdateDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<RawDetection>;
    }): Promise<RawDetection> => {
      const res = await fetch(`${API_BASE_URL}/api/detections/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Gagal memperbarui data deteksi');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-detections'] });
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}

export function useDeleteDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<RawDetection> => {
      const res = await fetch(`${API_BASE_URL}/api/detections/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Gagal menghapus data deteksi');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-detections'] });
      queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] });
    },
  });
}
