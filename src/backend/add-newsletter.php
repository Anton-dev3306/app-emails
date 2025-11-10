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

// Log para debugging
error_log("ADD NEWSLETTER - Group: $groupId, Email: $senderEmail, Name: $senderName");

try {
    // Verificar que el grupo existe
    $stmt = $pdo->prepare('SELECT id FROM "NewsletterGroup" WHERE id = :groupId');
    $stmt->execute([':groupId' => $groupId]);
    $groupExists = $stmt->fetchColumn();

    if (!$groupExists) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
        exit;
    }

    // Verificar si la newsletter ya está en el grupo
    $stmt = $pdo->prepare('
        SELECT id FROM "NewsletterGroupItem"
        WHERE "groupId" = :groupId AND "senderEmail" = :senderEmail
    ');
    $stmt->execute([
        ':groupId' => $groupId,
        ':senderEmail' => $senderEmail
    ]);
    $alreadyExists = $stmt->fetchColumn();

    if ($alreadyExists) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Esta newsletter ya está en el grupo']);
        exit;
    }

    // Insertar la newsletter en el grupo
    $itemId = generateCuid();
    $stmt = $pdo->prepare('
        INSERT INTO "NewsletterGroupItem"
        (id, "groupId", "senderEmail", "senderName", "addedAt")
        VALUES (:id, :groupId, :senderEmail, :senderName, NOW())
        RETURNING id, "groupId", "senderEmail", "senderName", "addedAt"
    ');
    $stmt->execute([
        ':id' => $itemId,
        ':groupId' => $groupId,
        ':senderEmail' => $senderEmail,
        ':senderName' => $senderName
    ]);

    $insertedItem = $stmt->fetch(PDO::FETCH_ASSOC);

    error_log("ADD NEWSLETTER SUCCESS - Item ID: $itemId");

    echo json_encode([
        'success' => true,
        'message' => 'Newsletter agregada exitosamente al grupo',
        'item' => $insertedItem
    ]);

} catch (PDOException $e) {
    error_log("ADD NEWSLETTER ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al agregar newsletter: ' . $e->getMessage()
    ]);
}
?>