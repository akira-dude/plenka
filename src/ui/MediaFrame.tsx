import type { ComponentProps } from 'react';
import { isVideo, type MediaItem } from '@/domain/post';
import { useMediaUri } from '@/hooks/useMediaUri';
import { mediaUri } from '@/storage/paths';
import { PhotoFrame } from './PhotoFrame';
import { VideoBadge } from './VideoBadge';

type Props = Omit<ComponentProps<typeof PhotoFrame>, 'uri' | 'blurUri' | 'w' | 'h'> & {
  dir: string;
  item: MediaItem;
  fetch: boolean;
};

export function MediaFrame({ dir, item, fetch, ...frame }: Props) {
  const video = isVideo(item);
  const uri = useMediaUri(dir, item, fetch && !video);
  const thumb = mediaUri(dir, item.thumb);
  return (
    <PhotoFrame uri={video ? thumb : uri} blurUri={thumb} w={item.w} h={item.h} {...frame}>
      {video && <VideoBadge duration={item.duration} />}
    </PhotoFrame>
  );
}
