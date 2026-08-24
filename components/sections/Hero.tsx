import { site } from "@/lib/config/content";

/**
 * Hero: app name + subheading on the left, intro body text on the right.
 */
export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <h1 className="font-heading text-3xl font-black leading-tight text-off-white md:text-4xl">
            {site.appName}
          </h1>
          <p className="mt-3 font-body text-lg italic text-racing-red">
            {site.subheading}
          </p>
        </div>
        <p className="font-body text-base leading-relaxed text-off-white/80 md:text-lg">
          {site.heroBody}
        </p>
      </div>
    </section>
  );
}
