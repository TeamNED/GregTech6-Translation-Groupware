#ifndef LANGFILE_H
#define LANGFILE_H
#pragma once

#include <iostream>
#include <string>
#include <utility>
#include <vector>

using std::string;
using std::vector;

using LangFileItem = std::pair<string, string>;

class LangFile {
private:
  vector<LangFileItem> _items;

public:
  vector<LangFileItem> &items();
  const vector<LangFileItem> &items() const;
};

std::istream &operator>>(std::istream &strm, LangFile &self);
std::ostream &operator<<(std::ostream &strm, const LangFile &self);
#endif