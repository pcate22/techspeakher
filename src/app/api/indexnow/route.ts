import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/constants/site";
import sitemap from "@/app/sitemap";

const noStore = { "Cache-Control": "no-store" };

// Soumet toutes les URLs du sitemap au protocole IndexNow (Bing, Yandex,
// Seznam…). Protégé par le secret REVALIDATE_SECRET. La clé IndexNow vient de
// l'environnement (INDEXNOW_KEY) : elle n'est plus en dur dans le code. Elle
// doit correspondre au fichier de vérification public `/<clé>.txt`.
export async function GET(request: NextRequest) {
  const configured = process.env.REVALIDATE_SECRET;
  if (!configured) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET not configured on the server" },
      { status: 500, headers: noStore },
    );
  }
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (secret !== configured) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  const indexNowKey = process.env.INDEXNOW_KEY;
  if (!indexNowKey) {
    return NextResponse.json(
      { error: "INDEXNOW_KEY not configured on the server" },
      { status: 500, headers: noStore },
    );
  }

  const urlList = (await sitemap()).map((entry) => entry.url);
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(BASE_URL).host,
      key: indexNowKey,
      keyLocation: `${BASE_URL}/${indexNowKey}.txt`,
      urlList,
    }),
  });

  return NextResponse.json(
    { submitted: urlList.length, indexnowStatus: response.status },
    { status: response.ok ? 200 : 502, headers: noStore },
  );
}
