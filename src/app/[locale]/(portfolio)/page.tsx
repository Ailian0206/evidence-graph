import { EvidenceHero } from "@/components/portfolio/evidence-hero";
import { PracticeNotes } from "@/components/portfolio/practice-notes";
import { ProfileBand } from "@/components/portfolio/profile-band";
import { SelectedWork } from "@/components/portfolio/selected-work";

export default function PortfolioPage() {
  return (
    <>
      <EvidenceHero />
      <SelectedWork />
      <PracticeNotes />
      <ProfileBand />
    </>
  );
}
