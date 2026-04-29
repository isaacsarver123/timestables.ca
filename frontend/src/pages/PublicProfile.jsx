import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, UserMinus, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import AvatarSVG from "@/components/AvatarSVG";

export default function PublicProfile() {
  const { username } = useParams();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/u/${encodeURIComponent(username)}`);
      setProfile(data);
    } catch (e) {
      setErr(formatErr(e.response?.data?.detail) || "Not found");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [username]);

  if (err) return <div className="text-rose-600 text-center py-10" data-testid="public-profile-error">{err}</div>;
  if (!profile) return <div className="text-muted text-center py-10">Loading…</div>;

  if (profile.is_self) {
    nav("/profile", { replace: true });
    return null;
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (profile.am_following) {
        await api.delete(`/u/${username}/follow`);
        toast.success(`Unfollowed ${profile.name}`);
      } else {
        await api.post(`/u/${username}/follow`);
        toast.success(`Followed ${profile.name}`);
      }
      await load();
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Action failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto" data-testid="public-profile-page">
      <Link to="/profile" className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1">
        <ArrowLeft size={12} /> Back
      </Link>

      <div
        className="brut-border brut-shadow relative px-5 sm:px-7 pt-7 pb-7 text-white mt-2"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 60%, #4C1D95 100%)" }}
      >
        <div className="flex flex-col items-center text-center">
          <AvatarSVG config={profile.avatar} size={120} />
          <div className="mt-4 font-black text-2xl sm:text-3xl tracking-tight" data-testid="public-profile-name">
            {profile.name}
          </div>
          {profile.username && <div className="text-white/70 text-sm mt-0.5">@{profile.username}</div>}

          {profile.private_locked ? (
            <div className="mt-4 brut-border-soft bg-white/15 backdrop-blur px-4 py-3 text-sm flex items-center gap-2" data-testid="public-profile-locked">
              <Lock size={14} /> This profile is private.
            </div>
          ) : (
            <>
              {profile.bio && <div className="text-white/85 text-sm mt-2 max-w-md">{profile.bio}</div>}
              <div className="flex gap-6 mt-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-2xl tabular-nums">{profile.following}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Following</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl tabular-nums">{profile.followers}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Followers</div>
                </div>
              </div>
              <button
                onClick={toggle}
                disabled={busy}
                data-testid="public-profile-follow-btn"
                className={`mt-5 brut-border font-bold uppercase tracking-wider text-xs px-5 py-2.5 flex items-center gap-2 ${
                  profile.am_following
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-white text-purple-700 hover:bg-purple-50"
                }`}
              >
                {profile.am_following ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
