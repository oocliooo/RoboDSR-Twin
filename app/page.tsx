import type { Metadata } from "next";
import { TwinExperience } from "./twin-experience";

export const metadata: Metadata = {
  title: "RoboDSR Twin — Living Healthcare Spatial Intelligence",
  description:
    "An interactive 3D demonstration of a healthcare center that senses, reasons, coordinates, acts, and verifies as one living system.",
};

export default function Home() {
  return <TwinExperience />;
}
