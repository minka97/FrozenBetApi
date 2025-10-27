-- ============================================
-- SCHÉMA DE BASE DE DONNÉES - PLATEFORME DE PRONOSTICS FrozenBet
-- Hackathon M1 - Octobre 2025
-- ============================================

-- Table des utilisateurs
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des compétitions
CREATE TABLE competitions (
    id BIGSERIAL PRIMARY KEY,
    theme_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    season VARCHAR(50),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'finished', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des équipes/joueurs
CREATE TABLE teams (
    id BIGSERIAL PRIMARY KEY,
    competition_id BIGINT REFERENCES competitions(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    logo_url VARCHAR(500),
    country VARCHAR(100),
    external_api_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des matchs/parties
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    competition_id BIGINT REFERENCES competitions(id) ON DELETE CASCADE,
    home_team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
    home_score INTEGER,
    away_score INTEGER,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des groupes de pronostics
CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    competition_id BIGINT REFERENCES competitions(id) ON DELETE CASCADE,
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    invite_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des règles de score des groupes
CREATE TABLE group_scoring_rules (
    id SERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    rule_description TEXT,
    points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des membres des groupes
CREATE TABLE group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_points INTEGER DEFAULT 0,
    UNIQUE(group_id, user_id)
);

-- Table des pronostics
CREATE TABLE predictions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    home_score_prediction INTEGER NOT NULL,
    away_score_prediction INTEGER NOT NULL,
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    points_earned INTEGER,
    UNIQUE(user_id, match_id, group_id)
);

-- Table des invitations aux groupes
CREATE TABLE group_invitations (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- Table des bannissements
CREATE TABLE group_bans (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    banned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Table des classements (cache pour performance)
CREATE TABLE group_rankings (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    rank INTEGER,
    previous_rank INTEGER,
    UNIQUE(group_id, user_id)
);

-- ============================================
-- INDEX POUR OPTIMISATION DES PERFORMANCES
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_dates ON competitions(start_date, end_date);

CREATE INDEX idx_teams_competition ON teams(competition_id);

CREATE INDEX idx_matches_competition ON matches(competition_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled_date ON matches(scheduled_date);
CREATE INDEX idx_matches_teams ON matches(home_team_id, away_team_id);

CREATE INDEX idx_groups_owner ON groups(owner_id);
CREATE INDEX idx_groups_competition ON groups(competition_id);
CREATE INDEX idx_groups_visibility ON groups(visibility);
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_points ON group_members(group_id, total_points DESC);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_group ON predictions(group_id);
CREATE INDEX idx_predictions_composite ON predictions(user_id, match_id, group_id);

CREATE INDEX idx_group_rankings_group ON group_rankings(group_id);
CREATE INDEX idx_group_rankings_rank ON group_rankings(group_id, rank);
CREATE INDEX idx_group_rankings_user ON group_rankings(user_id);

CREATE INDEX idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_token ON group_invitations(token);
CREATE INDEX idx_group_invitations_status ON group_invitations(status);

CREATE INDEX idx_group_scoring_rules_group ON group_scoring_rules(group_id);

-- ============================================
-- TRIGGERS POUR MISE À JOUR AUTOMATIQUE
-- ============================================

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue pour le classement général d'un groupe
CREATE VIEW v_group_leaderboard AS
SELECT 
    gr.group_id,
    gr.user_id,
    u.username,
    gr.total_points,
    gr.total_predictions,
    gr.correct_predictions,
    gr.rank,
    gr.previous_rank,
    (gr.previous_rank - gr.rank) as rank_change
FROM group_rankings gr
JOIN users u ON gr.user_id = u.id
ORDER BY gr.group_id, gr.rank;

-- Vue pour les matchs à venir
CREATE VIEW v_upcoming_matches AS
SELECT 
    m.id,
    m.competition_id,
    c.name as competition_name,
    m.scheduled_date,
    ht.name as home_team,
    ht.logo_url as home_logo,
    at.name as away_team,
    at.logo_url as away_logo,
    m.location
FROM matches m
JOIN competitions c ON m.competition_id = c.id
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
WHERE m.status = 'scheduled'
AND m.scheduled_date > CURRENT_TIMESTAMP
ORDER BY m.scheduled_date;

-- Vue pour les matchs en direct
CREATE VIEW v_live_matches AS
SELECT 
    m.id,
    m.competition_id,
    c.name as competition_name,
    ht.name as home_team,
    ht.logo_url as home_logo,
    m.home_score,
    at.name as away_team,
    at.logo_url as away_logo,
    m.away_score,
    m.scheduled_date
FROM matches m
JOIN competitions c ON m.competition_id = c.id
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
WHERE m.status = 'live'
ORDER BY m.scheduled_date;

-- ============================================
-- COMMENTAIRES SUR LES TABLES
-- ============================================

COMMENT ON TABLE users IS 'Utilisateurs de la plateforme';
COMMENT ON TABLE competitions IS 'Compétitions sportives ou e-sportives';
COMMENT ON TABLE teams IS 'Équipes ou joueurs participants aux compétitions';
COMMENT ON TABLE matches IS 'Matchs ou parties des compétitions';
COMMENT ON TABLE groups IS 'Groupes de pronostics entre amis';
COMMENT ON TABLE group_scoring_rules IS 'Règles de calcul des points pour chaque groupe';
COMMENT ON TABLE group_members IS 'Membres appartenant aux groupes';
COMMENT ON TABLE predictions IS 'Pronostics des utilisateurs pour les matchs';
COMMENT ON TABLE group_invitations IS 'Invitations envoyées pour rejoindre un groupe';
COMMENT ON TABLE group_rankings IS 'Classements des membres dans chaque groupe (cache)';
