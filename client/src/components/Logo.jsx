export default function Logo({ size = 28 }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#4C3CB3" />
        <circle cx="16" cy="16" r="7" fill="#F2C879" />
        <circle cx="19" cy="14" r="6" fill="#4C3CB3" opacity=".9" />
      </svg>
      <span className="logo-text">Luma Salon</span>
    </span>
  );
}
