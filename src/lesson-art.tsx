export function LessonArt({ number, large = false }: { number: number; large?: boolean }) {
  const styles = ["mint", "lilac", "peach", "blue", "pink", "yellow", "lime", "purple", "sand", "sky"];
  const n = (number - 1) % 10;
  return <div className={`lesson-art art-${styles[n]} ${large ? "art-large" : ""}`} aria-hidden="true">
    {n === 0 && <div className="art-frames"><div className="frame-back"><i/><i/><i/></div><div className="frame-front"><div className="mini-nav"/><div className="mini-picture"><span/></div><div className="mini-line"/><div className="mini-line short"/></div><span className="art-label">Frame 01</span></div>}
    {n === 1 && <div className="art-shapes"><span className="shape-circle"/><span className="shape-star">✳</span><span className="shape-triangle"/><span className="shape-square"/></div>}
    {n === 2 && <div className="art-type"><span>Aa</span><div>MAKE YOUR<br/><b>TYPE COUNT.</b></div><i/></div>}
    {n === 3 && <div className="art-geometry"><span className="geo-one"/><span className="geo-two"/><span className="geo-three"/><div className="geo-plus">+</div></div>}
    {n === 4 && <svg viewBox="0 0 300 180"><path d="M40 135C65 15 135 20 150 90S235 165 260 45" fill="none" stroke="#007aff" strokeWidth="5"/><path d="M40 135L70 25M150 90L132 30M260 45L235 160" fill="none" stroke="#d2d2d7" strokeWidth="1.5" strokeDasharray="4 5"/>{[[40,135],[70,25],[150,90],[132,30],[260,45],[235,160]].map(([x,y],i)=><rect key={i} x={x-5} y={y-5} width="10" height="10" fill="#fff" stroke="#007aff" strokeWidth="2"/>)}<path d="M171 63l11 28-11-5-7 11z" fill="#1d1d1f" stroke="white" strokeWidth="2"/></svg>}
    {n === 5 && <svg viewBox="0 0 300 180"><path d="M48 122C85 10 123 160 154 65S214 155 252 58" fill="none" stroke="#ff3b30" strokeWidth="30" strokeLinecap="round"/><path d="M49 121C84 23 123 151 154 65S211 151 252 58" fill="none" stroke="#ffcc00" strokeWidth="2.5" strokeDasharray="2 5"/><path d="M61 51l4-12m8 17 11-5m-30-7-5-9" stroke="#34c759" strokeWidth="3" strokeLinecap="round"/></svg>}
    {n === 6 && <div className="art-motion"><span/><span/><span/><div>↗</div></div>}
    {n === 7 && <div className="art-loading"><span/><span/><span/><span/><div>loading ideas…</div></div>}
    {n === 8 && <div className="art-profile"><div className="mini-phone"><span className="phone-notch"/><span className="profile-head"/><strong>Hello, designer.</strong><i/><i/><b/></div><span className="floating-note">A little about me ↗</span></div>}
    {n === 9 && <div className="art-prototype"><div className="gallery-phone"><i/><div><span/><span/><span/><span/></div></div><span className="connect-arrow">→</span><div className="gallery-phone second"><i/><span className="gallery-image"/><b>← Back</b></div></div>}
  </div>;
}

export function HeroArt() {
  return <div className="hero-art" aria-hidden="true">
    <svg className="hero-canvas-svg" viewBox="0 0 420 330" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="24" y="18" width="372" height="294" rx="22" fill="#fff" stroke="#e5e5ea" strokeWidth="1.5"/>
      <path d="M25 64H395" stroke="#e5e5ea"/>
      <circle cx="48" cy="41" r="4" fill="#ff3b30"/>
      <circle cx="62" cy="41" r="4" fill="#ffcc00"/>
      <circle cx="76" cy="41" r="4" fill="#34c759"/>
      <path d="M186 34L196 42L191 43L189 48L186 34Z" fill="#1d1d1f"/>
      <rect x="211" y="35" width="12" height="12" rx="3" stroke="#8e8e93" strokeWidth="1.5"/>
      <path d="M240 35H252M246 35V47" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M356 39H372M356 44H366" stroke="#d2d2d7" strokeWidth="2" strokeLinecap="round"/>

      <circle cx="142" cy="135" r="40" fill="#ff3b30"/>
      <rect x="216" y="95" width="80" height="80" rx="20" fill="#007aff"/>
      <path d="M102 270V234C102 211.909 119.909 194 142 194C164.091 194 182 211.909 182 234V270H102Z" fill="#ffcc00"/>
      <path d="M252.536 199C254.075 196.333 257.925 196.333 259.464 199L296.703 263.5C298.243 266.167 296.318 269.5 293.239 269.5H218.761C215.682 269.5 213.757 266.167 215.297 263.5L252.536 199Z" fill="#34c759"/>

      <rect x="209" y="88" width="94" height="94" stroke="#007aff" strokeWidth="1.3"/>
      {[[209, 88], [303, 88], [209, 182], [303, 182]].map(([x, y], i) => <rect key={i} x={x - 3} y={y - 3} width="6" height="6" fill="#fff" stroke="#007aff" strokeWidth="1.3"/>)}
      <path d="M291 168L312 187L301 188L296 199L291 168Z" fill="#1d1d1f" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  </div>;
}
