<?php
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Permitir que los parámetros también lleguen por GET
$groupId = $input['group_id'] ?? $_GET['group_id'] ?? null;
$senderEmail = $input['sender_email'] ?? $_GET['sender_email'] ?? null;

if (empty($groupId) || empty($senderEmail)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'ID de grupo y email del remitente son requeridos'
    ]);
    exit;
}

$senderEmail = filter_var($senderEmail, FILTER_SANITIZE_EMAIL);

// Log para debugging
error_log("REMOVE NEWSLETTER - Group: $groupId, Email: $senderEmail");

try {
    // Verificar que el item existe
    $stmt = $pdo->prepare('
        SELECT id, "senderEmail", "senderName"
        FROM "NewsletterGroupItem"
        WHERE "groupId" = :groupId AND "senderEmail" = :senderEmail
    ');
    $stmt->execute([
        ':groupId' => $groupId,
        ':senderEmail' => $senderEmail
    ]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Newsletter no encontrada en este grupo'
        ]);
        exit;
    }

    // Eliminar newsletter del grupo
    $stmt = $pdo->prepare('
        DELETE FROM "NewsletterGroupItem"
        WHERE "groupId" = :groupId AND "senderEmail" = :senderEmail
    ');
    $stmt->execute([
        ':groupId' => $groupId,
        ':senderEmail' => $senderEmail
    ]);

    $deletedCount = $stmt->rowCount();

    error_log("REMOVE NEWSLETTER SUCCESS - Deleted: $deletedCount");

    echo json_encode([
        'success' => true,
        'message' => 'Newsletter removida del grupo correctamente',
        'removed_item' => [
            'id' => $item['id'],
            'sender_email' => $item['senderEmail'],
            'sender_name' => $item['senderName']
        ]
    ]);

} catch (PDOException $e) {
    error_log("REMOVE NEWSLETTER ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al remover newsletter: ' . $e->getMessage()
    ]);
}
?>