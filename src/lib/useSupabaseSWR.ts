import useSWR, { SWRConfiguration } from 'swr'

export function useSupabaseSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: 10000,
    keepPreviousData: true,
    ...config,
  })
}
