CREATE TABLE advice_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    mood_record_id INT NULL,
    analysis NVARCHAR(1000) NOT NULL,
    suggestions NVARCHAR(MAX) NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mood_record_id) REFERENCES moods(id) ON DELETE SET NULL
);

CREATE INDEX idx_advice_history_user_id ON advice_history(user_id);
CREATE INDEX idx_advice_history_created_at ON advice_history(created_at DESC);
