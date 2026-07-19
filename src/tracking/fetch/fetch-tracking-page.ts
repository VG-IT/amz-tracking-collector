import { fetchInfo } from "../../services/api";
import { TRACK_LINK_SELECTOR } from "../selectors";

const TRACK_LINK_TEXTS = [
  "track package",
  "track shipment",
  "track your package",
  "lieferung verfolgen",
  "sendung verfolgen",
  "realizar seguimiento de paquete",
  "seguir paquete",
  "rastrear paquete",
  "suivre le colis",
  "suivre l'envoi",
];

export async function fetchTrackingPage(
  shipmentElem: Element,
): Promise<Document | null> {
  const links = shipmentElem.querySelectorAll(TRACK_LINK_SELECTOR);

  for (const link of Array.from(links)) {
    const text = (link.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const href =
      link.getAttribute("data-savepage-href") ||
      link.getAttribute("href") ||
      "";

    const textMatched = TRACK_LINK_TEXTS.some((t) => text.includes(t));
    const hrefMatched = /ship-track|progress-tracker|package\/track/i.test(href);

    if (!textMatched && !hrefMatched) continue;
    if (!href) continue;

    return fetchInfo(href);
  }

  return null;
}
