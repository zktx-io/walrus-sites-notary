const badges = [
  {
    href: 'https://www.bestpractices.dev/projects/12049',
    src: 'https://www.bestpractices.dev/projects/12049/baseline',
    alt: 'OpenSSF Baseline',
  },
  {
    href: 'https://scorecard.dev/viewer/?uri=github.com/zktx-io/walrus-sites-notary',
    src: 'https://api.scorecard.dev/projects/github.com/zktx-io/walrus-sites-notary/badge',
    alt: 'OpenSSF Scorecard',
  },
  {
    href: 'https://github.com/zktx-io/walrus-sites-notary/actions/workflows/build-test.yml',
    src: 'https://github.com/zktx-io/walrus-sites-notary/actions/workflows/build-test.yml/badge.svg',
    alt: 'CI',
  },
  {
    href: 'https://github.com/zktx-io/walrus-sites-notary/actions/workflows/sast.yml',
    src: 'https://github.com/zktx-io/walrus-sites-notary/actions/workflows/sast.yml/badge.svg',
    alt: 'SAST',
  },
];

export const TrustBadges = () => {
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {badges.map((badge) => (
          <a
            key={badge.alt}
            href={badge.href}
            target="_blank"
            rel="noreferrer"
            className="opacity-80 transition-opacity duration-200 hover:opacity-100"
            aria-label={badge.alt}
          >
            <img src={badge.src} alt={badge.alt} className="h-5 w-auto" />
          </a>
        ))}
      </div>
    </div>
  );
};
