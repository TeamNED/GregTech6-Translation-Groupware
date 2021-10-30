#ifndef DICTGENERATOR_H
#define DICTGENERATOR_H
#pragma once

#include <unordered_map>

#include "Generator.hpp"

using std::unordered_map;

class DictGenerator : public virtual Generator {
private:
  unordered_map<string, string> _dict;
  shared_ptr<ILangResult> _result;

public:
  DictGenerator() = default;
  DictGenerator(shared_ptr<IGeneratorMeta> meta);
  DictGenerator(shared_ptr<IGeneratorMeta> meta,
                unordered_map<string, string> dict);
  DictGenerator(const DictGenerator &) = default;
  DictGenerator(DictGenerator &&) = default;
  DictGenerator &operator=(const DictGenerator &) = default;
  DictGenerator &operator=(DictGenerator &&) = default;
  virtual ~DictGenerator() = default;

  virtual unordered_map<string, string> &dict();
  virtual vector<shared_ptr<ILangResult>> results() override;
};
#endif