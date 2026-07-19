import type { ChannelDTO } from '@/lib/types';
import { ChannelCard } from './ChannelCard';

export function ChannelGrid({
  channels,
  onView,
  onEdit,
  onDelete,
}: {
  channels: ChannelDTO[];
  onView: (channel: ChannelDTO) => void;
  onEdit: (channel: ChannelDTO) => void;
  onDelete: (channel: ChannelDTO) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
