#ifndef DICTGENERATOR_H
#define DICTGENERATOR_H
#pragma once

#include "Generator.hpp"

class DictGenerator : public Generator {
private:
  LangListPointer _dict;

public:
  DictGenerator(shared_ptr<IGeneratorMeta> meta);
  DictGenerator(shared_ptr<IGeneratorMeta> meta, LangListPointer dict);

  virtual LangListPointer &dict();
  virtual const LangListPointer &dict() const;
  virtual vector<shared_ptr<ILangResult>>
  results(IGroupRepository *repo) const override;
};
#endif