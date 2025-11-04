<?php
// remove-newsletter.php
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// Permitir que los parámetros también lleguen por GET si se desea
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

try {
    // Verificar que el item existe
    $stmt = $pdo->prepare('
        SELECT "senderEmail", "senderName"
        FROM "NewsletterGroupItem"
        WHERE "groupId" = $1 AND "senderEmail" = $2
    ');
    $stmt->execute([$groupId, $senderEmail]);
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
        WHERE "groupId" = $1 AND "senderEmail" = $2
    ');
    $stmt->execute([$groupId, $senderEmail]);

    echo json_encode([
        'success' => true,
        'message' => 'Newsletter removida del grupo correctamente',
        'removed_item' => [
            'sender_email' => $item['senderEmail'],
            'sender_name' => $item['senderName']
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al remover newsletter: ' . $e->getMessage()
    ]);
}
?>
