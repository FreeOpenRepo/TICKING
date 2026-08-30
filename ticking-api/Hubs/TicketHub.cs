using Microsoft.AspNetCore.SignalR;

namespace ticking_api.Hubs;

public class TicketHub : Hub
{
    public async Task JoinArena(string arenaId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, arenaId);
    }
}
