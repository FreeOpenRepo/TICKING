using Microsoft.EntityFrameworkCore;
using ticking_api.Models;

namespace ticking_api.Data;

public class TicketingDbContext : DbContext
{
    public TicketingDbContext(DbContextOptions<TicketingDbContext> options) : base(options)
    {
    }

    public DbSet<Seat> Seats => Set<Seat>();
    public DbSet<BookingOrder> BookingOrders => Set<BookingOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var seats = new List<Seat>();
        int id = 1;

        // 1. VIP Floor (Row VIP-A, VIP-B, 5,500 THB each, 8 seats per row)
        string[] vipRows = { "A", "B" };
        foreach (var r in vipRows)
        {
            for (int num = 1; num <= 8; num++)
            {
                seats.Add(new Seat
                {
                    Id = id++,
                    SeatCode = $"VIP-{r}{num}",
                    Section = "VIP Center Stage",
                    Row = r,
                    Number = num,
                    Tier = SeatTier.VIP_FLOOR,
                    Price = 5500m,
                    Status = SeatStatus.AVAILABLE
                });
            }
        }

        // 2. Zone A (Row A-A, A-B, 3,500 THB each, 10 seats per row)
        string[] zoneARows = { "A", "B" };
        foreach (var r in zoneARows)
        {
            for (int num = 1; num <= 10; num++)
            {
                seats.Add(new Seat
                {
                    Id = id++,
                    SeatCode = $"ZA-{r}{num}",
                    Section = "Zone A Tier 1",
                    Row = r,
                    Number = num,
                    Tier = SeatTier.ZONE_A,
                    Price = 3500m,
                    Status = SeatStatus.AVAILABLE
                });
            }
        }

        // 3. Zone B (Row B-A, B-B, 2,000 THB each, 12 seats per row)
        string[] zoneBRows = { "A", "B" };
        foreach (var r in zoneBRows)
        {
            for (int num = 1; num <= 12; num++)
            {
                seats.Add(new Seat
                {
                    Id = id++,
                    SeatCode = $"ZB-{r}{num}",
                    Section = "Zone B Grandstand",
                    Row = r,
                    Number = num,
                    Tier = SeatTier.ZONE_B,
                    Price = 2000m,
                    Status = SeatStatus.AVAILABLE
                });
            }
        }

        modelBuilder.Entity<Seat>().HasData(seats);
    }
}
