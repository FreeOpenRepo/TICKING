using System.Security.Cryptography;
using System.Text;
using QRCoder;

namespace ticking_api.Services;

public class TicketQrService
{
    private const string HmacSecretKey = "FreeOpenRepo_Ticketing_HMAC_Secret_2026_Key!";

    public string SignTicketPayload(string orderCode, string customerEmail, string seatCodes, decimal totalAmount)
    {
        var rawData = $"{orderCode}|{customerEmail}|{seatCodes}|{totalAmount:F2}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(HmacSecretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawData));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public string GenerateQrCodeBase64(string payload)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);
        var qrCodeBytes = qrCode.GetGraphic(10);
        return $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";
    }

    public (bool IsValid, string? ErrorMessage) VerifyHmacSignature(
        string orderCode,
        string customerEmail,
        string seatCodes,
        decimal totalAmount,
        string providedSignature)
    {
        var expectedSignature = SignTicketPayload(orderCode, customerEmail, seatCodes, totalAmount);
        if (string.Equals(expectedSignature, providedSignature, StringComparison.OrdinalIgnoreCase))
        {
            return (true, null);
        }

        return (false, "Cryptographic HMAC-SHA256 signature verification failed. Counterfeit or tampered ticket detected!");
    }
}
