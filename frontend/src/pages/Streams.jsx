import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tv, Clock, Users, Radio, Calendar } from 'lucide-react';
import { getStreams } from '../api/streams';

const GRADIENT_COLORS = [
  'from-blue-900 to-purple-900',
  'from-red-900 to-pink-900',
  'from-green-900 to-teal-900',
  'from-yellow-900 to-orange-900',
  'from-indigo-900 to-blue-900',
  'from-purple-900 to-pink-900',
];

function StreamCard({ stream }) {
  const gradientIndex = stream.id % GRADIENT_COLORS.length;
  const gradient = GRADIENT_COLORS[gradientIndex];
  const creatorName = stream.creator?.display_name || stream.creator?.username || 'Creator';
  const isLive = stream.status === 'live';

  return (
    <Link to={`/stream/${stream.id}`} className="block group">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#3a3a3a] transition-all hover:-translate-y-0.5">
        {/* Thumbnail */}
        <div className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          {stream.thumbnail_url ? (
            <img src={stream.thumbnail_url} alt={stream.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-40">
              {isLive ? <Radio size={40} className="text-white" /> : <Tv size={40} className="text-white" />}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {isLive && (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
            {stream.status === 'scheduled' && (
              <span className="bg-[#00b8ff]/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Calendar size={10} /> SOON
              </span>
            )}
          </div>

          {isLive && stream.viewer_count != null && (
            <div className="absolute top-3 right-3">
              <span className="bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Users size={11} /> {stream.viewer_count}
              </span>
            </div>
          )}

          {stream.is_paid && (
            <div className="absolute bottom-3 right-3">
              <span className="bg-[#00b8ff] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                ${(stream.price_cents / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-white font-semibold text-sm truncate mb-1 group-hover:text-[#00b8ff] transition-colors">
            {stream.title}
          </p>
          <div className="flex items-center gap-2">
            {stream.creator?.avatar_url ? (
              <img src={stream.creator.avatar_url} alt={creatorName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {creatorName[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-gray-400 text-xs truncate">{creatorName}</p>
          </div>
          {stream.status === 'scheduled' && stream.scheduled_at && (
            <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1">
              <Clock size={11} />
              {new Date(stream.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Streams() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchStreams = async (p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getStreams(p);
      if (res.data.success) {
        const data = res.data.data || [];
        setStreams((prev) => append ? [...prev, ...data] : data);
        setHasMore(data.length >= 12);
        setPage(p);
      }
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchStreams(1);
  }, []);

  const liveStreams = streams.filter((s) => s.status === 'live');
  const scheduledStreams = streams.filter((s) => s.status === 'scheduled');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-[#00b8ff]/10 border border-[#00b8ff]/30 flex items-center justify-center">
            <Tv size={20} className="text-[#00b8ff]" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Live Streams</h1>
            <p className="text-gray-400 text-sm">Watch your favorite creators live</p>
          </div>
        </div>

        {/* Live Now */}
        {liveStreams.length > 0 && (
          <section className="mb-10">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Live Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {liveStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {scheduledStreams.length > 0 && (
          <section className="mb-10">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-[#00b8ff]" />
              Upcoming Streams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scheduledStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          </section>
        )}

        {/* All streams if nothing categorized */}
        {liveStreams.length === 0 && scheduledStreams.length === 0 && (
          streams.length > 0 ? (
            <section className="mb-10">
              <h2 className="text-white font-bold text-lg mb-4">All Streams</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {streams.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : (
            <div className="text-center py-20">
              <Radio size={48} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-semibold mb-2">No streams yet</p>
              <p className="text-gray-600 text-sm">Follow creators to get notified when they go live</p>
            </div>
          )
        )}

        {/* Load more */}
        {hasMore && streams.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => fetchStreams(page + 1, true)}
              disabled={loadingMore}
              className="bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#00b8ff] text-white hover:text-[#00b8ff] font-semibold rounded-xl px-6 py-3 transition-colors disabled:opacity-50 text-sm"
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
