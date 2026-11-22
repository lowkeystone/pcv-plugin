import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { showConfirmationModal } from "@vendetta/ui/alerts";

const PermissionStore = findByStoreName("PermissionStore");
const GuildStore = findByStoreName("GuildStore");
const ChannelStore = findByStoreName("ChannelStore");
const RestAPI = findByProps("post", "get", "put", "patch");

let unpatchPerms = null;
let unpatchMenu = null;

function forwardModal(message) {
    const guilds = Object.values(GuildStore?.getGuilds() ?? {});
    const channels = Object.values(ChannelStore?.getChannels() ?? {}).filter(c => c.type === 0 || c.type === 5);

    let guildId = guilds[0]?.id ?? "";
    let chanId = channels.filter(c => c.guild_id === guildId)[0]?.id ?? "";

    const getChans = (gid) => channels.filter(c => c.guild_id === gid);

    showConfirmationModal(
        "📨 Forward Message",
        `Select destination to forward this message from ${message.author?.username}`,
        {
            confirmText: "Forward",
            cancelText: "Cancel",
            onConfirm: async () => {
                if (!chanId) return showToast("Pick a channel!", { type: "danger" });
                const note = "";
                await RestAPI.post({
                    url: `/channels/${chanId}/messages`,
                    body: {
                        content: "",
                        embeds: [{
                            color: 0x5865f2,
                            author: {
                                name: message.author?.username ?? "Unknown",
                                icon_url: `https://cdn.discordapp.com/avatars/${message.author?.id}/${message.author?.avatar}.png`,
                            },
                            description: message.content || "*[no text]*",
                            footer: { text: `Forwarded` },
                            timestamp: new Date(message.timestamp).toISOString(),
                        }],
                    },
                });
                showToast("✅ Forwarded!", { type: "success" });
            },
        }
    );
}

export default {
    onLoad() {
        // patch canViewChannel → always true
        if (PermissionStore) {
            const orig = PermissionStore.canViewChannel?.bind(PermissionStore);
            PermissionStore.canViewChannel = () => true;
            unpatchPerms = () => { if (orig) PermissionStore.canViewChannel = orig; };
        }

        // patch context menu
        const MessageContextMenu = findByProps("MessageContextMenu") ?? findByProps("useMessageMenu");
        if (MessageContextMenu) {
            const key = Object.keys(MessageContextMenu).find(k => typeof MessageContextMenu[k] === "function");
            if (key) {
                unpatchMenu = after(key, MessageContextMenu, ([props], res) => {
                    const msg = props?.message;
                    if (!msg || !res?.props?.children) return;
                    res.props.children.push({
                        type: "button",
                        label: "📨 Forward",
                        action: () => forwardModal(msg),
                    });
                });
            }
        }

        showToast("PrivateChannelViewer ON", { type: "success" });
    },

    onUnload() {
        unpatchPerms?.();
        unpatchMenu?.();
    },
};
