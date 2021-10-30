#ifndef DICTGENERATOR_H
#define DICTGENERATOR_H
#pragma once

#include <unordered_map>

#include "Generator.hpp"

using std::shared_ptr;
using kvlist = std::unordered_map<string, string>;
using pkvlist = shared_ptr<kvlist>;

class DictGenerator : public virtual Generator {
private:
  pkvlist _dict;
  shared_ptr<ILangResult> _result;

public:
  DictGenerator(shared_ptr<IGeneratorMeta> meta);
  DictGenerator(shared_ptr<IGeneratorMeta> meta, pkvlist dict);

  virtual pkvlist dict();
  virtual vector<shared_ptr<ILangResult>> results() override;
};
#endif