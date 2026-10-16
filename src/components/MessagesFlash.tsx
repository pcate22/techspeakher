import { errMessage, okMessage } from "@/lib/tremplin-messages";

/**
 * Les messages `?err=` / `?ok=` d'un retour d'action destructive (pattern PRG,
 * principes §4), rendus UNE fois pour toutes.
 *
 * Le couple `role="alert"` / `role="status"` et les paires de couleurs
 * approuvées (§8) se décidaient jusqu'ici à la main sur chaque page — six
 * copies, dont une avait déjà dérivé. Ici, une erreur interrompt (`alert`), une
 * confirmation attend son tour (`status`), et le contraste est celui du
 * registre, pas celui que la page a retenu.
 *
 * Composant SERVEUR : le message est présent au premier rendu, donc lisible par
 * un lecteur d'écran qui arrive sur la page (à la différence de
 * `ConfirmationBanner`, qui se remplit après coup pour pouvoir nettoyer l'URL).
 */
export default function MessagesFlash({ err, ok }: { err?: string; ok?: string }) {
  const errMsg = errMessage(err);
  const okMsg = okMessage(ok);
  if (!errMsg && !okMsg) return null;
  return (
    <>
      {errMsg && (
        <p
          role="alert"
          className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
        >
          {errMsg}
        </p>
      )}
      {okMsg && (
        <p
          role="status"
          className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"
        >
          {okMsg}
        </p>
      )}
    </>
  );
}
