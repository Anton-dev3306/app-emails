<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$groupId = $input['group_id'] ?? null;
$userEmail = $input['user_email'] ?? null;

if (!$groupId || !$userEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID de grupo y email de usuario son requeridos']);
    exit;
}

$userEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);

try {
    $stmt = $pdo->prepare('
        SELECT id, "groupName", description, color
        FROM "NewsletterGroup"
        WHERE id = $1 AND "userEmail" = $2
    ');
    $stmt->execute([$groupId, $userEmail]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
        exit;
    }

    $updates = [];
    $params = [];
    $paramIndex = 1;

    if (!empty($input['group_name'])) {
        $newName = trim($input['group_name']);
        $checkStmt = $pdo->prepare('
            SELECT id FROM "NewsletterGroup"
            WHERE "userEmail" = $1 AND "groupName" = $2 AND id != $3
        ');
        $checkStmt->execute([$userEmail, $newName, $groupId]);

        if ($checkStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Ya existe un grupo con este nombre']);
            exit;
        }

        $updates[] = '"groupName" = $' . $paramIndex++;
        $params[] = $newName;
    }

    if (array_key_exists('description', $input)) {
        $updates[] = 'description = $' . $paramIndex++;
        $params[] = $input['description'];
    }

    if (array_key_exists('color', $input)) {
        $updates[] = 'color = $' . $paramIndex++;
        $params[] = $input['color'];
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se proporcionaron campos para actualizar']);
        exit;
    }

    $updates[] = '"updatedAt" = NOW()';
    $params[] = $groupId;

    $sql = 'UPDATE "NewsletterGroup" SET ' . implode(', ', $updates) . ' WHERE id = $' . $paramIndex;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $stmt = $pdo->prepare('
        SELECT
            g.id, g."groupName", g.description, g.color, g."createdAt", g."updatedAt",
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
        FROM "NewsletterGroup" g
        WHERE g.id = $1
    ');
    $stmt->execute([$groupId]);
    $updatedGroup = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Grupo actualizado exitosamente',
        'group' => $updatedGroup
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al actualizar el grupo: ' . $e->getMessage()
    ]);
}
?>
