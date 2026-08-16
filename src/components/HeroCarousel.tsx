import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import soccerImg from "@/assets/hero-soccer.jpg";
import basketballImg from "@/assets/hero-basketball.jpg";
import casinoImg from "@/assets/hero-casino.jpg";

interface Slide {
  image: string;
  kicker: string;
  title: string;
  copy: string;
  cta: string;
  to: string;
}

const SLIDES: Slide[] = [
  {
    image: soccerImg,
    kicker: "Football tonight",
    title: "Every kick, every market",
    copy: "Premier League, LaLiga and Champions League — 1X2, handicaps, goals and in-play prices.",
    cta: "Browse football",
    to: "/sports/football",
  },
  {
    image: basketballImg,
    kicker: "Live in-play",
    title: "Odds that move with the game",
    copy: "Follow the swing shot by shot and cash in on momentum before the buzzer.",
    cta: "Go to live",
    to: "/live",
  },
  {
    image: casinoImg,
    kicker: "Casino floor",
    title: "Tables, slots and instant wins",
    copy: "Roulette, blackjack and hundreds of reels from the studios players actually ask for.",
    cta: "Enter casino",
    to: "/casino",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [index]);

  return (
    <section className="relative h-[420px] w-full overflow-hidden border-b border-border sm:h-[480px] lg:h-[560px]">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.title}
          className={`absolute inset-0 transition-all duration-700 ease-out ${
            i === index
              ? "translate-x-0 opacity-100"
              : i === (index - 1 + SLIDES.length) % SLIDES.length
                ? "pointer-events-none -translate-x-8 opacity-0"
                : "pointer-events-none translate-x-8 opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          <img
            src={slide.image}
            alt={slide.title}
            width={1920}
            height={1088}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full scale-105 object-cover brightness-[1.25] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

          <div className="absolute inset-0 flex items-center px-5 sm:px-10 lg:px-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                {slide.kicker}
              </span>
              <h1 className="mt-4 text-3xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {slide.title}
              </h1>
              <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">{slide.copy}</p>
              <Link
                to={slide.to}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
              >
                {slide.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 block -translate-y-1/2 rounded-full border border-border bg-card/70 p-2 text-foreground backdrop-blur transition-colors hover:bg-card"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 block -translate-y-1/2 rounded-full border border-border bg-card/70 p-2 text-foreground backdrop-blur transition-colors hover:bg-card"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-5 left-5 flex items-center gap-2 sm:left-10 lg:left-16">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show slide ${i + 1}`}
            className={`h-1.5 overflow-hidden rounded-full transition-all ${i === index ? "w-12 bg-primary/25" : "w-3 bg-muted-foreground/40 hover:bg-muted-foreground"}`}
          >
            {i === index ? (
              <span
                key={`p-${index}`}
                className="block h-full w-full origin-left animate-[hero-progress_5s_linear_forwards] bg-primary"
              />
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
