import footballImg from "@/assets/sport-football.jpg";
import basketballImg from "@/assets/sport-basketball.jpg";
import tennisImg from "@/assets/sport-tennis.jpg";
import esportsImg from "@/assets/sport-esports.jpg";
import baseballImg from "@/assets/sport-baseball.jpg";

// Sports are database-driven, so this only covers the codes we have art for;
// any other sport code falls back to the football image.
export const SPORT_IMAGES: Record<string, string> = {
  football: footballImg,
  basketball: basketballImg,
  tennis: tennisImg,
  esports: esportsImg,
  baseball: baseballImg,
};

export function getSportImage(sportId: string): string {
  return SPORT_IMAGES[sportId] ?? footballImg;
}
