#ifndef DICTGENERATOR_H
#define DICTGENERATOR_H
#pragma once

#include "Generator.hpp"

class DictGenerator : public virtual Generator {
private:
  LangListPointer _dict;
  shared_ptr<ILangResult> _result;

public:
  DictGenerator(shared_ptr<IGeneratorMeta> meta);
  DictGenerator(shared_ptr<IGeneratorMeta> meta, LangListPointer dict);

  virtual LangListPointer &dict();
  virtual vector<shared_ptr<ILangResult>> results() override;
};
#endif