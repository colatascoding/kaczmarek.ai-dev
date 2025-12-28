/**
 * Notification Log View
 */

/**
 * Load notification log view
 */
async function loadNotificationsV2() {
  const container = document.getElementById("notifications-view");
  if (!container) return;
  
  const notifications = window.getNotificationLog ? window.getNotificationLog() : [];
  
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h1 style="margin: 0; font-size: 2rem; font-weight: 600;">Notification Log</h1>
        <div style="display: flex; gap: 1rem;">
          <button 
            class="btn btn-secondary" 
            onclick="clearNotificationLog(); loadNotificationsV2();"
            style="padding: 0.5rem 1rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;"
          >
            Clear Log
          </button>
          <button 
            class="btn btn-primary" 
            onclick="loadNotificationsV2();"
            style="padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); cursor: pointer;"
          >
            Refresh
          </button>
        </div>
      </div>
      
      <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;">
        ${notifications.length === 0 ? `
          <div style="padding: 3rem; text-align: center; color: var(--text-light);">
            <p style="font-size: 1.125rem; margin-bottom: 0.5rem;">No notifications yet</p>
            <p style="font-size: 0.875rem;">Notifications will appear here as they are shown in the app.</p>
          </div>
        ` : `
          <div style="max-height: calc(100vh - 200px); overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="background: var(--bg-secondary); position: sticky; top: 0; z-index: 10;">
                <tr>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border);">Time</th>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border);">Type</th>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border);">Message</th>
                </tr>
              </thead>
              <tbody>
                ${notifications.map(notif => {
                  const typeColors = {
                    info: "#3b82f6",
                    success: "#10b981",
                    error: "#ef4444",
                    warning: "#f59e0b"
                  };
                  
                  const typeIcons = {
                    info: "ℹ️",
                    success: "✓",
                    error: "✗",
                    warning: "⚠️"
                  };
                  
                  const date = new Date(notif.timestamp);
                  const timeStr = date.toLocaleString();
                  
                  return `
                    <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
                      <td style="padding: 1rem; font-size: 0.875rem; color: var(--text-light); white-space: nowrap;">
                        ${timeStr}
                      </td>
                      <td style="padding: 1rem;">
                        <span style="
                          display: inline-flex;
                          align-items: center;
                          gap: 0.5rem;
                          padding: 0.25rem 0.75rem;
                          border-radius: var(--radius-sm);
                          background: ${typeColors[notif.type] || typeColors.info}20;
                          color: ${typeColors[notif.type] || typeColors.info};
                          font-size: 0.875rem;
                          font-weight: 500;
                        ">
                          ${typeIcons[notif.type] || typeIcons.info} ${notif.type.toUpperCase()}
                        </span>
                      </td>
                      <td style="padding: 1rem; color: var(--text);">
                        ${escapeHtml(notif.message)}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
      
      ${notifications.length > 0 ? `
        <div style="margin-top: 1rem; text-align: center; color: var(--text-light); font-size: 0.875rem;">
          Showing ${notifications.length} notification${notifications.length === 1 ? "" : "s"} (max 1000 stored)
        </div>
      ` : ""}
    </div>
  `;
}

// Use centralized escapeHtml from utils.js
// If not available, fallback to local implementation
const escapeHtml = window.escapeHtml || function(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
};

// Expose globally
window.loadNotificationsV2 = loadNotificationsV2;

