import type { ComponentProps } from 'react';
import type { MediaItem } from '@/domain/post';
import { useMediaUri } from '@/hooks/useMediaUri';
import { mediaUri } from '@/storage/paths';
import { PhotoFrame } from './PhotoFrame';

type Props = Omit<ComponentProps<typeof PhotoFrame>, 'uri' | 'blurUri' | 'w' | 'h'> & {
  dir: string;
  item: MediaItem;
  fetch: boolean;
};

export function MediaFrame({ dir, item, fetch, ...frame }: Props) {
  const uri = useMediaUri(dir, item, fetch);
  return <PhotoFrame uri={uri} blurUri={mediaUri(dir, item.thumb)} w={item.w} h={item.h} {...frame} />;
}
