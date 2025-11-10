<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$userEmail = $_GET['user_email'] ?? null;
$groupId = $_GET['group_id'] ?? null;

if (!$userEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email de usuario requerido']);
    exit;
}

$userEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);

// Log para debugging
error_log("READ GROUPS - User Email: " . $userEmail);

try {
    // Si se solicita un grupo específico
    if ($groupId) {
        $stmt = $pdo->prepare('
            SELECT
                g.id, g."groupName", g.description, g.color, g."createdAt", g."updatedAt",
                (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
            FROM "NewsletterGroup" g
            WHERE g.id = :groupId AND g."userEmail" = :userEmail
        ');
        $stmt->execute([
            ':groupId' => $groupId,
            ':userEmail' => $userEmail
        ]);
        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
            exit;
        }

        // Obtener newsletters del grupo
        $stmt = $pdo->prepare('
            SELECT id, "senderEmail", "senderName", "addedAt"
            FROM "NewsletterGroupItem"
            WHERE "groupId" = :groupId
            ORDER BY "addedAt" DESC
        ');
        $stmt->execute([':groupId' => $groupId]);
        $group['newsletters'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'group' => $group]);
        exit;
    }

    // Obtener todos los grupos del usuario
    $stmt = $pdo->prepare('
        SELECT
            g.id,
            g."groupName",
            g.description,
            g.color,
            g."createdAt",
            g."updatedAt",
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
        FROM "NewsletterGroup" g
        WHERE g."userEmail" = :userEmail
        ORDER BY g."createdAt" DESC
    ');

    $stmt->execute([':userEmail' => $userEmail]);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Log para debugging
    error_log("READ GROUPS - Grupos encontrados: " . count($groups));

    // Si no hay grupos, retornar array vacío
    if (empty($groups)) {
        echo json_encode(['success' => true, 'total' => 0, 'groups' => []]);
        exit;
    }

    // Obtener newsletters para cada grupo
    $newsletterStmt = $pdo->prepare('
        SELECT id, "senderEmail", "senderName", "addedAt"
        FROM "NewsletterGroupItem"
        WHERE "groupId" = :groupId
        ORDER BY "addedAt" DESC
    ');

    foreach ($groups as &$group) {
        $newsletterStmt->execute([':groupId' => $group['id']]);
        $group['newsletters'] = $newsletterStmt->fetchAll(PDO::FETCH_ASSOC);

        // Log para debugging
        error_log("Grupo: " . $group['groupName'] . " - Newsletters: " . count($group['newsletters']));
    }

    echo json_encode([
        'success' => true,
        'total' => count($groups),
        'groups' => $groups
    ]);

} catch (PDOException $e) {
    error_log("READ GROUPS ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener grupos: ' . $e->getMessage()
    ]);
}
?>