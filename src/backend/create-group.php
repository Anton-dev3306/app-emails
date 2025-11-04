<?php
require_once 'db.php';
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Método no permitido']);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$userEmail = filter_var($input['user_email'] ?? '', FILTER_SANITIZE_EMAIL);
$groupName = trim($input['group_name'] ?? '');
$description = trim($input['description'] ?? '');
$color = $input['color'] ?? '#3b82f6';
$newsletters = $input['newsletters'] ?? [];

if (!$userEmail || !$groupName) {
    respond(400, ['success' => false, 'error' => 'Email y nombre del grupo son requeridos']);
}

try {
    $stmt = $pdo->prepare('SELECT id FROM "NewsletterGroup" WHERE "userEmail" = ? AND "groupName" = ?');
    $stmt->execute([$userEmail, $groupName]);

    if ($stmt->fetch()) {
        respond(409, ['success' => false, 'error' => 'Ya existe un grupo con este nombre']);
    }
    $groupId = generateCuid();
    $pdo->prepare('
        INSERT INTO "NewsletterGroup" (id, "userEmail", "groupName", description, color, "createdAt", "updatedAt")
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ')->execute([$groupId, $userEmail, $groupName, $description, $color]);

    $added = 0;
    if ($newsletters) {
        $stmt = $pdo->prepare('
            INSERT INTO "NewsletterGroupItem" (id, "groupId", "senderEmail", "senderName", "addedAt")
            VALUES (?, ?, ?, ?, NOW())
            ON CONFLICT ("groupId", "senderEmail") DO NOTHING
        ');

        foreach ($newsletters as $n) {
            if (empty($n['sender_email'])) continue;

            try {
                $stmt->execute([
                    generateCuid(),
                    $groupId,
                    $n['sender_email'],
                    $n['sender_name'] ?? null
                ]);
                $added++;
            } catch (PDOException) {
            }
        }
    }
    respond(200, [
        'success' => true,
        'message' => 'Grupo creado exitosamente',
        'group' => [
            'id' => $groupId,
            'group_name' => $groupName,
            'description' => $description,
            'color' => $color,
            'newsletters_added' => $added,
        ]
    ]);

} catch (PDOException $e) {
    respond(500, [
        'success' => false,
        'error' => 'Error al crear el grupo: ' . $e->getMessage()
    ]);
}
