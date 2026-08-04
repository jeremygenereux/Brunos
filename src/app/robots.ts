import type { MetadataRoute } from "next";

/**
 * Les Brunos ne cherche pas d'audience : c'est une application privée, sur
 * invitation. Le référencement n'est donc pas un objectif mais un risque, et
 * on ferme la porte à toute indexation.
 *
 * Ce fichier ne fait que la MOITIÉ du travail. `robots.txt` est une consigne,
 * pas une barrière : un robot qui l'ignore passe outre, et un moteur qui
 * respecte le `Disallow` sans jamais visiter la page peut malgré tout en
 * afficher l'URL nue si un lien externe la lui signale — puisqu'il n'aura
 * jamais vu la consigne « noindex » qui, elle, exige d'entrer.
 *
 * D'où l'en-tête `X-Robots-Tag: noindex, nofollow` posé sur toutes les routes
 * dans `next.config.ts`. Les deux se complètent : la consigne écarte les
 * robots polis, l'en-tête neutralise les autres.
 *
 * La confidentialité réelle, elle, ne repose sur aucun des deux : sans session,
 * les politiques RLS ne rendent absolument rien. Ceci n'est qu'une couche de
 * discrétion par-dessus.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
