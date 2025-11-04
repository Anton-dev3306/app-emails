<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$groupId = $input['group_id'] ?? null;
$senderEmail = $input['sender_email'] ?? null;
$senderName = $input['sender_name'] ?? null;

if (!$groupId || !$senderEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de grupo y email del remitente son requeridos']);
    exit;
}

$senderEmail = filter_var($senderEmail, FILTER_SANITIZE_EMAIL);

try {
    $stmt = $pdo->prepare('SELECT id FROM "NewsletterGroup" WHERE id = $1');
    $stmt->execute([$groupId]);
    $groupExists = $stmt->fetchColumn();

    if (!$groupExists) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
        exit;
    }

    $stmt = $pdo->prepare('
        SELECT id FROM "NewsletterGroupItem"
        WHERE "groupId" = $1 AND "senderEmail" = $2
    ');
    $stmt->execute([$groupId, $senderEmail]);
    $alreadyExists = $stmt->fetchColumn();

    if ($alreadyExists) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Esta newsletter ya está en el grupo']);
        exit;
    }

    $itemId = generateCuid();
    $stmt = $pdo->prepare('
        INSERT INTO "NewsletterGroupItem" (id, "groupId", "senderEmail", "senderName", "addedAt")
        VALUES ($1, $2, $3, $4, NOW())
    ');
    $stmt->execute([$itemId, $groupId, $senderEmail, $senderName]);

    echo json_encode([
        'success' => true,
        'message' => 'Newsletter agregada exitosamente al grupo',
        'item' => [
            'id' => $itemId,
            'group_id' => $groupId,
            'sender_email' => $senderEmail,
            'sender_name' => $senderName
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al agregar newsletter: ' . $e->getMessage()
    ]);
}
?>
