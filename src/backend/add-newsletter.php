<?php
// add-newsletter.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['group_id']) || empty($input['sender_email'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'ID de grupo y email del remitente son requeridos'
    ]);
    exit;
}

$groupId = $input['group_id'];
$senderEmail = filter_var($input['sender_email'], FILTER_SANITIZE_EMAIL);
$senderName = $input['sender_name'] ?? null;

try {
    // Verificar que el grupo existe
    $stmt = $pdo->prepare('SELECT id FROM "NewsletterGroup" WHERE id = $1');
    $stmt->execute([$groupId]);

    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Grupo no encontrado'
        ]);
        exit;
    }

    // Verificar si la newsletter ya está en el grupo
    $stmt = $pdo->prepare('
        SELECT id FROM "NewsletterGroupItem"
        WHERE "groupId" = $1 AND "senderEmail" = $2
    ');
    $stmt->execute([$groupId, $senderEmail]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'error' => 'Esta newsletter ya está en el grupo'
        ]);
        exit;
    }

    // Agregar newsletter al grupo
    $itemId = generateCuid();
    $stmt = $pdo->prepare('
        INSERT INTO "NewsletterGroupItem" (id, "groupId", "senderEmail", "senderName", "addedAt")
        VALUES ($1, $2, $3, $4, NOW())
    ');
    $stmt->execute([$itemId, $groupId, $senderEmail, $senderName]);

    echo json_encode([
        'success' => true,
        'message' => 'Newsletter agregada al grupo',
        'item_id' => $itemId
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al agregar newsletter: ' . $e->getMessage()
    ]);
}
?>