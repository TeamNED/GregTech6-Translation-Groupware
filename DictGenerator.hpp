#ifndef DICTGENERATOR_H
#define DICTGENERATOR_H
#pragma once

#include <map>

#include "Generator.hpp"

using std::map;

class DictGenerator : public virtual Generator {
private:
  map<string, string> _dict;

public:
  DictGenerator() = default;
  DictGenerator(string group, string namespace_prefix, bool cached,
                bool completed, vector<string> extensions,
                map<string, string> dict);
  DictGenerator(const DictGenerator &) = default;
  DictGenerator(DictGenerator &&) = default;
  DictGenerator &operator=(const DictGenerator &) = default;
  DictGenerator &operator=(DictGenerator &&) = default;
  virtual ~DictGenerator() = default;

  virtual map<string, string> &dict();
};
#endif