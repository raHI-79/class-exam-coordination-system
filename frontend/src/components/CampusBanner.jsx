import bannerMonument from '../assets/banner-monument.jpg';
import bannerBuilding from '../assets/banner-building.jpg';
import bannerEntrance from '../assets/banner-entrance.jpg';

const SLIDES = [bannerMonument, bannerBuilding, bannerEntrance];

// A slim, animated letterhead strip — three campus photos crossfading in
// sequence via a CSS animation (no JS timer needed). Shared by every
// dashboard through DashboardShell, so every page carries a piece of campus.
export default function CampusBanner() {
  return (
    <div className="relative h-24 sm:h-28 w-full overflow-hidden border-b border-slate-200">
      {SLIDES.map((src, i) => (
        <div key={i} className="hero-slide" style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900/70 via-brand-900/30 to-transparent" />
      <div className="relative z-10 h-full flex items-center px-4 lg:px-8">
        <div>
          <div className="text-white font-brand text-lg sm:text-xl font-semibold tracking-wide drop-shadow">
            Shahjalal University of Science and Technology
          </div>
          <div className="text-white/80 text-xs sm:text-sm">Department of Computer Science &amp; Engineering</div>
        </div>
      </div>
    </div>
  );
}
