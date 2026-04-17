import { DiscordSDK } from "https://esm.sh/@discord/embedded-app-sdk";

const DISCORD_CLIENT_ID = "1494554951341314050";

export async function initDiscordActivity() {
  try {
    const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);
    await discordSdk.ready();

    window.discordSdk = discordSdk;
    window.isDiscordActivity = true;
    document.documentElement.dataset.discordActivity = "true";

    console.log("WarChaos conectado como Discord Activity");

    const badge = document.createElement("div");
    badge.textContent = "Rodando dentro do Discord";
    badge.style.position = "fixed";
    badge.style.bottom = "12px";
    badge.style.right = "12px";
    badge.style.zIndex = "9999";
    badge.style.padding = "8px 12px";
    badge.style.borderRadius = "999px";
    badge.style.background = "#5865F2";
    badge.style.color = "#fff";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "Arial, sans-serif";
    badge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    document.body.appendChild(badge);

    return discordSdk;
  } catch (error) {
    console.log("Rodando fora do Discord ou SDK indisponível:", error);
    window.isDiscordActivity = false;
    document.documentElement.dataset.discordActivity = "false";
    return null;
  }
}
