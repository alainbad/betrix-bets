import footballImg from "@/assets/sport-football.jpg";
import basketballImg from "@/assets/sport-basketball.jpg";
import tennisImg from "@/assets/sport-tennis.jpg";
import esportsImg from "@/assets/sport-esports.jpg";
import baseballImg from "@/assets/sport-baseball.jpg";
import type { SportId } from "./betting-data";

export const SPORT_IMAGES: Record<SportId, string> = {
  football: footballImg,
  basketball: basketballImg,
  tennis: tennisImg,
  esports: esportsImg,
  baseball: baseballImg,
};
