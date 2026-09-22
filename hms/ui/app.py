"""Application bootstrap: wires LoginWindow -> MainWindow with a shared UISession."""
import sys

from PySide6.QtWidgets import QApplication

from hms.db import init_db
from hms.ui.session_context import UISession
from hms.ui.login_window import LoginWindow
from hms.ui.main_window import MainWindow


class HMSApp:
    def __init__(self):
        init_db()
        self.qapp = QApplication.instance() or QApplication(sys.argv)
        self.ui_session = UISession()
        self.login_window = None
        self.main_window = None
        self.show_login()

    def show_login(self):
        self.ui_session = UISession()
        self.login_window = LoginWindow(self.ui_session, self.show_main)
        self.login_window.show()

    def show_main(self):
        self.login_window.close()
        self.main_window = MainWindow(self.ui_session, self.show_login)
        self.main_window.show()

    def run(self):
        return self.qapp.exec()


def main():
    app = HMSApp()
    sys.exit(app.run())


if __name__ == "__main__":
    main()
