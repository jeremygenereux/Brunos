import { redirect } from "next/navigation";

/**
 * Le palmarès inter-éditions vit désormais directement dans /archive (les
 * statistiques d'abord, le choix d'une édition ensuite). On garde la route pour
 * ne pas casser les liens déjà partagés.
 */
export default function ArchiveStatsPage() {
  redirect("/archive");
}
