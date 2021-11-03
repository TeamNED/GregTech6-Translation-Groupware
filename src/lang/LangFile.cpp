#include "LangFile.hpp"

vector<LangFileItem> &LangFile::items() { return this->_items; }
const vector<LangFileItem> &LangFile::items() const { return this->_items; }

std::istream &operator>>(std::istream &strm, LangFile &self) {
  std::string line;
  auto &items = self.items();
  while (std::getline(strm, line)) {
    size_t pos = line.find('=');
    if (pos != string::npos) {
      size_t start = line.find_first_not_of(" ");
      items.emplace_back(line.substr(start, pos - start), line.substr(pos + 1));
    }
  }
  return strm;
}

std::ostream &operator<<(std::ostream &strm, const LangFile &self) {
  strm << "# Configuration file" << std::endl
       << "enablelangfile {" << std::endl
       << "     B:UseThisFileAsLanguageFile=true" << std::endl
       << "}" << std::endl
       << std::endl
       << "languagefile {" << std::endl;
  for (const auto &item : self.items()) {
    strm << "    " << item.first << "=" << item.second << std::endl;
  }
  strm << "}" << std::endl << std::endl;
  return strm;
}